/**
 * 安全验证模块
 * 提供文件路径安全验证，防止路径遍历攻击和敏感文件访问
 */
import * as path from 'path';
import * as fs from 'fs/promises';
import micromatch from 'micromatch';
// ============== 常量定义 ==============
/**
 * 默认敏感文件模式
 * 这些文件可能包含敏感信息，默认不允许访问
 */
export const DEFAULT_SENSITIVE_PATTERNS = [
    // 环境变量文件
    '.env',
    '.env.*',
    '.env.local',
    '.env.development',
    '.env.production',
    '**/.env',
    '**/.env.*',
    // SSH 和密钥文件
    '.ssh/**',
    '**/.ssh/**',
    '*.pem',
    '*.key',
    '*.pfx',
    '*.p12',
    '**/id_rsa',
    '**/id_rsa.*',
    '**/id_ed25519',
    '**/id_ed25519.*',
    '**/id_dsa',
    '**/id_dsa.*',
    // 凭证和密钥文件
    '**/credentials*',
    '**/secrets*',
    '**/secret.*',
    '**/*password*',
    '**/*token*',
    // Git 敏感配置
    '**/.git/config',
    '**/.gitconfig',
    // 数据库文件
    '*.sqlite',
    '*.sqlite3',
    '*.db',
    // 历史记录文件
    '**/.bash_history',
    '**/.zsh_history',
    '**/.node_repl_history',
    // AWS 和云服务配置
    '**/.aws/**',
    '**/.azure/**',
    '**/.gcloud/**',
    // Docker secrets
    '**/docker-compose*.yml',
    '**/docker-compose*.yaml',
];
/**
 * 默认安全配置
 */
export const DEFAULT_SECURITY_CONFIG = {
    allowedDirectories: [], // 空数组表示不限制
    sensitivePatterns: DEFAULT_SENSITIVE_PATTERNS,
    maxFileSize: 1024 * 1024, // 1MB
    maxFiles: 500,
    allowSymlinks: false,
};
// ============== 错误类定义 ==============
/**
 * 安全错误类
 * 当安全验证失败时抛出此错误
 */
export class SecurityError extends Error {
    code;
    path;
    /**
     * 创建安全错误实例
     * @param message 错误消息
     * @param code 错误代码
     * @param path 相关的文件路径（可选）
     */
    constructor(message, code, path) {
        super(message);
        this.code = code;
        this.path = path;
        this.name = 'SecurityError';
        // 确保原型链正确（TypeScript 编译后的兼容性）
        Object.setPrototypeOf(this, SecurityError.prototype);
    }
}
// ============== 工具函数 ==============
/**
 * 规范化路径
 * 将路径转换为统一的格式，处理 Windows 和 Unix 路径差异
 *
 * @param inputPath 输入路径
 * @returns 规范化后的绝对路径
 *
 * @example
 * normalizePath('./src/index.ts')  // 返回绝对路径
 * normalizePath('C:\\Users\\test') // 返回 C:/Users/test
 */
export function normalizePath(inputPath) {
    // 解析为绝对路径
    const absolutePath = path.resolve(inputPath);
    // 统一使用正斜杠（方便跨平台处理）
    return absolutePath.replace(/\\/g, '/');
}
/**
 * 检测路径是否包含路径遍历攻击
 *
 * 使用 path.relative 方法来安全地检测路径遍历，
 * 避免简单的 includes('..') 检查误杀合法文件名（如 vendor..lib.js）
 *
 * @param inputPath 要检测的路径
 * @param basePath 基准路径（默认为当前工作目录）
 * @returns 如果包含路径遍历则返回 true
 *
 * @example
 * hasPathTraversal('../etc/passwd')      // true
 * hasPathTraversal('./src/index.ts')     // false
 * hasPathTraversal('./vendor..lib.js')   // false（合法文件名）
 */
export function hasPathTraversal(inputPath, basePath) {
    // 获取基准路径（默认为当前工作目录）
    const base = basePath ? path.resolve(basePath) : process.cwd();
    // 解析输入路径为绝对路径
    const resolvedPath = path.resolve(base, inputPath);
    // 使用 path.relative 计算相对路径
    // 如果结果以 '..' 开头，说明路径试图跳出基准目录
    const relativePath = path.relative(base, resolvedPath);
    // 检查相对路径是否以 '..' 开头（表示路径遍历）
    // 或者是绝对路径（在 Windows 上可能是 'C:' 开头）
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        return true;
    }
    // 额外检查：路径段中不应该有单独的 '..' 作为目录名
    // 这是为了防止一些边缘情况
    const segments = inputPath.split(/[/\\]/);
    for (const segment of segments) {
        // 只检查完全等于 '..' 的段，而不是包含 '..' 的文件名
        if (segment === '..') {
            return true;
        }
    }
    return false;
}
/**
 * 检查文件是否为敏感文件
 *
 * @param filePath 文件路径
 * @param patterns 敏感文件模式列表（glob 模式）
 * @returns 如果是敏感文件返回 true
 *
 * @example
 * isSensitiveFile('.env')                    // true
 * isSensitiveFile('./src/index.ts')          // false
 * isSensitiveFile('./config/credentials.json') // true
 */
export function isSensitiveFile(filePath, patterns = DEFAULT_SENSITIVE_PATTERNS) {
    // 获取文件名和路径
    const normalizedPath = filePath.replace(/\\/g, '/');
    const fileName = path.basename(normalizedPath);
    // 使用 micromatch 进行 glob 模式匹配
    const isMatch = micromatch.isMatch(normalizedPath, patterns, {
        dot: true, // 匹配以 . 开头的文件
        nocase: true, // 忽略大小写
        basename: false // 使用完整路径匹配
    });
    // 额外检查文件名
    const fileNameMatch = micromatch.isMatch(fileName, patterns, {
        dot: true,
        nocase: true
    });
    return isMatch || fileNameMatch;
}
/**
 * 检查路径是否在允许的目录内
 *
 * 使用 path.relative 方法来安全地检查路径是否在允许的目录内，
 * 避免简单的前缀匹配被绕过（如 /var/www-secret 匹配 /var/www）
 *
 * @param filePath 要检查的文件路径
 * @param allowedDirs 允许的目录列表
 * @returns 如果在允许的目录内返回 true
 *
 * @example
 * isWithinAllowedDirectory('./src/index.ts', ['./src', './lib']) // true
 * isWithinAllowedDirectory('./etc/passwd', ['./src'])            // false
 * isWithinAllowedDirectory('/var/www-secret', ['/var/www'])      // false（修复：不会被绕过）
 */
export function isWithinAllowedDirectory(filePath, allowedDirs) {
    // 如果白名单为空，允许所有路径
    if (!allowedDirs || allowedDirs.length === 0) {
        return true;
    }
    // 解析为绝对路径
    const absoluteFilePath = path.resolve(filePath);
    for (const dir of allowedDirs) {
        const absoluteDir = path.resolve(dir);
        // 使用 path.relative 计算相对路径
        const relativePath = path.relative(absoluteDir, absoluteFilePath);
        // 如果相对路径不以 '..' 开头且不是绝对路径，
        // 说明文件在允许的目录内或就是允许的目录本身
        if (!relativePath.startsWith('..') && !path.isAbsolute(relativePath)) {
            // 额外检查：空字符串表示路径完全相同
            // 非空字符串表示是子路径
            return true;
        }
    }
    return false;
}
/**
 * 检查是否为符号链接
 *
 * @param filePath 文件路径
 * @returns 如果是符号链接返回 true
 */
export async function isSymlink(filePath) {
    try {
        const stats = await fs.lstat(filePath);
        return stats.isSymbolicLink();
    }
    catch {
        // 文件不存在或无法访问，返回 false
        return false;
    }
}
/**
 * 获取文件大小
 *
 * @param filePath 文件路径
 * @returns 文件大小（字节）
 */
export async function getFileSize(filePath) {
    const stats = await fs.stat(filePath);
    return stats.size;
}
// ============== 主要验证函数 ==============
/**
 * 验证单个路径的安全性
 * 执行完整的安全检查，包括路径遍历、敏感文件、白名单和符号链接检测
 *
 * @param inputPath 要验证的路径
 * @param config 安全配置（可选）
 * @throws SecurityError 当安全验证失败时抛出
 *
 * @example
 * // 正常使用
 * await validatePath('./src/index.ts');
 *
 * // 带白名单
 * await validatePath('./src/index.ts', { allowedDirectories: ['./src'] });
 *
 * // 路径遍历攻击会抛出错误
 * await validatePath('../../../etc/passwd'); // 抛出 SecurityError
 */
export async function validatePath(inputPath, config) {
    const mergedConfig = { ...DEFAULT_SECURITY_CONFIG, ...config };
    // 1. 检查路径遍历攻击
    if (hasPathTraversal(inputPath)) {
        throw new SecurityError(`路径遍历攻击被阻止: "${inputPath}" 包含不允许的路径遍历模式`, 'PATH_TRAVERSAL', inputPath);
    }
    // 2. 检查是否为敏感文件
    if (isSensitiveFile(inputPath, mergedConfig.sensitivePatterns)) {
        throw new SecurityError(`访问敏感文件被拒绝: "${inputPath}" 匹配敏感文件模式`, 'SENSITIVE_FILE', inputPath);
    }
    // 3. 检查是否在白名单目录内
    if (!isWithinAllowedDirectory(inputPath, mergedConfig.allowedDirectories || [])) {
        throw new SecurityError(`访问被拒绝: "${inputPath}" 不在允许的目录列表中`, 'ACCESS_DENIED', inputPath);
    }
    // 4. 检查符号链接（如果文件存在）
    if (!mergedConfig.allowSymlinks) {
        try {
            if (await isSymlink(inputPath)) {
                throw new SecurityError(`符号链接访问被拒绝: "${inputPath}" 是一个符号链接`, 'SYMLINK_DETECTED', inputPath);
            }
        }
        catch (error) {
            // 如果是 SecurityError，继续抛出
            if (error instanceof SecurityError) {
                throw error;
            }
            // 文件不存在时忽略符号链接检查（让后续的文件读取来处理）
        }
    }
}
/**
 * 批量验证多个路径的安全性
 *
 * @param paths 要验证的路径数组
 * @param config 安全配置（可选）
 * @throws SecurityError 当任何路径验证失败时抛出
 *
 * @example
 * await validatePaths(['./src/a.ts', './src/b.ts']);
 */
export async function validatePaths(paths, config) {
    for (const filePath of paths) {
        await validatePath(filePath, config);
    }
}
/**
 * 验证文件大小是否在限制内
 *
 * @param filePath 文件路径
 * @param maxSize 最大文件大小（字节）
 * @throws SecurityError 当文件大小超限时抛出
 */
export async function validateFileSize(filePath, maxSize = DEFAULT_SECURITY_CONFIG.maxFileSize) {
    try {
        const size = await getFileSize(filePath);
        if (size > maxSize) {
            throw new SecurityError(`文件大小超限: "${filePath}" 大小为 ${formatBytes(size)}，超过限制 ${formatBytes(maxSize)}`, 'SIZE_EXCEEDED', filePath);
        }
    }
    catch (error) {
        if (error instanceof SecurityError) {
            throw error;
        }
        // 文件不存在时忽略大小检查（让后续的文件读取来处理）
    }
}
/**
 * 验证文件数量是否在限制内
 *
 * @param count 文件数量
 * @param maxFiles 最大文件数量
 * @throws SecurityError 当文件数量超限时抛出
 */
export function validateFileCount(count, maxFiles = DEFAULT_SECURITY_CONFIG.maxFiles) {
    if (count > maxFiles) {
        throw new SecurityError(`文件数量超限: 发现 ${count} 个文件，超过限制 ${maxFiles} 个`, 'FILE_LIMIT_EXCEEDED');
    }
}
// ============== 辅助函数 ==============
/**
 * 格式化字节数为人类可读格式
 *
 * @param bytes 字节数
 * @returns 格式化后的字符串
 */
function formatBytes(bytes) {
    if (bytes === 0)
        return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
/**
 * 合并安全配置
 *
 * @param userConfig 用户提供的配置
 * @returns 合并后的完整配置
 */
export function mergeSecurityConfig(userConfig) {
    return {
        ...DEFAULT_SECURITY_CONFIG,
        ...userConfig,
        // 合并敏感文件模式（而不是覆盖）
        sensitivePatterns: [
            ...DEFAULT_SENSITIVE_PATTERNS,
            ...(userConfig?.sensitivePatterns || [])
        ]
    };
}
//# sourceMappingURL=security.js.map