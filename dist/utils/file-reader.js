/**
 * 文件读取工具模块
 * 提供单文件读取和目录批量读取功能，支持 glob 模式过滤
 */
import fg from 'fast-glob';
import * as fs from 'fs/promises';
import * as path from 'path';
import { validatePath, validateFileSize, validateFileCount, SecurityError, DEFAULT_SECURITY_CONFIG } from './security.js';
// ============== 常量定义 ==============
/**
 * 默认排除模式
 * 这些目录/文件通常不需要分析
 */
export const DEFAULT_EXCLUDE_PATTERNS = [
    // 依赖目录
    'node_modules/**',
    'vendor/**',
    'bower_components/**',
    // 构建输出
    'dist/**',
    'build/**',
    'out/**',
    '.next/**',
    '.nuxt/**',
    '.output/**',
    // 测试覆盖率
    'coverage/**',
    '.nyc_output/**',
    // 缓存目录
    '.cache/**',
    '.parcel-cache/**',
    '.turbo/**',
    // 锁文件
    '*.lock',
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    // 压缩/编译后文件
    '*.min.js',
    '*.min.css',
    '*.bundle.js',
    '*.chunk.js',
    // Source map
    '*.map',
    '*.js.map',
    '*.css.map',
    // 版本控制
    '.git/**',
    '.svn/**',
    '.hg/**',
    // IDE 配置
    '.idea/**',
    '.vscode/**',
    '*.code-workspace',
    // 日志文件
    '*.log',
    'logs/**',
    // 临时文件
    'tmp/**',
    'temp/**',
    '.tmp/**',
];
/**
 * 二进制文件扩展名
 * 这些文件无法作为文本读取，应该跳过
 */
export const BINARY_EXTENSIONS = [
    // 图片
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.svg', '.tiff', '.avif',
    // 音频
    '.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.wma',
    // 视频
    '.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.webm', '.m4v',
    // 压缩包
    '.zip', '.tar', '.gz', '.rar', '.7z', '.bz2', '.xz',
    // 可执行文件
    '.exe', '.dll', '.so', '.dylib', '.bin', '.app', '.msi',
    // 文档（二进制格式）
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp',
    // 字体
    '.woff', '.woff2', '.ttf', '.eot', '.otf',
    // 数据库
    '.db', '.sqlite', '.sqlite3', '.mdb',
    // 其他二进制
    '.class', '.jar', '.pyc', '.pyo', '.o', '.obj', '.a', '.lib',
    '.ico', '.icns', '.cur',
];
/**
 * 编程语言映射表
 * 根据文件扩展名检测编程语言
 */
const LANGUAGE_MAP = {
    // JavaScript/TypeScript
    '.js': 'JavaScript',
    '.jsx': 'JavaScript (JSX)',
    '.ts': 'TypeScript',
    '.tsx': 'TypeScript (TSX)',
    '.mjs': 'JavaScript (ESM)',
    '.cjs': 'JavaScript (CommonJS)',
    // Web
    '.html': 'HTML',
    '.htm': 'HTML',
    '.css': 'CSS',
    '.scss': 'SCSS',
    '.sass': 'Sass',
    '.less': 'Less',
    '.vue': 'Vue',
    '.svelte': 'Svelte',
    // Python
    '.py': 'Python',
    '.pyw': 'Python',
    '.pyx': 'Cython',
    '.pyi': 'Python (Stub)',
    // Java/JVM
    '.java': 'Java',
    '.kt': 'Kotlin',
    '.kts': 'Kotlin Script',
    '.scala': 'Scala',
    '.groovy': 'Groovy',
    // C 家族
    '.c': 'C',
    '.h': 'C Header',
    '.cpp': 'C++',
    '.cc': 'C++',
    '.cxx': 'C++',
    '.hpp': 'C++ Header',
    '.hxx': 'C++ Header',
    // Go
    '.go': 'Go',
    // Rust
    '.rs': 'Rust',
    // Ruby
    '.rb': 'Ruby',
    '.erb': 'ERB',
    // PHP
    '.php': 'PHP',
    // Swift
    '.swift': 'Swift',
    // Shell
    '.sh': 'Shell',
    '.bash': 'Bash',
    '.zsh': 'Zsh',
    '.fish': 'Fish',
    '.ps1': 'PowerShell',
    '.bat': 'Batch',
    '.cmd': 'Batch',
    // 配置文件
    '.json': 'JSON',
    '.yaml': 'YAML',
    '.yml': 'YAML',
    '.toml': 'TOML',
    '.xml': 'XML',
    '.ini': 'INI',
    '.cfg': 'Config',
    '.conf': 'Config',
    // 数据格式
    '.csv': 'CSV',
    '.tsv': 'TSV',
    // 文档
    '.md': 'Markdown',
    '.mdx': 'MDX',
    '.rst': 'reStructuredText',
    '.txt': 'Plain Text',
    // 数据库
    '.sql': 'SQL',
    '.graphql': 'GraphQL',
    '.gql': 'GraphQL',
    // 其他
    '.r': 'R',
    '.R': 'R',
    '.lua': 'Lua',
    '.pl': 'Perl',
    '.ex': 'Elixir',
    '.exs': 'Elixir Script',
    '.erl': 'Erlang',
    '.hrl': 'Erlang Header',
    '.clj': 'Clojure',
    '.cljs': 'ClojureScript',
    '.dart': 'Dart',
    '.zig': 'Zig',
    '.nim': 'Nim',
    '.ml': 'OCaml',
    '.mli': 'OCaml Interface',
    '.fs': 'F#',
    '.fsx': 'F# Script',
    '.hs': 'Haskell',
    // Docker/Container
    '.dockerfile': 'Dockerfile',
    // 模板
    '.ejs': 'EJS',
    '.hbs': 'Handlebars',
    '.pug': 'Pug',
    '.jade': 'Jade',
    '.njk': 'Nunjucks',
    '.twig': 'Twig',
    '.jinja': 'Jinja',
    '.jinja2': 'Jinja2',
};
// ============== 错误类定义 ==============
/**
 * 文件读取错误类
 */
export class FileReadError extends Error {
    filePath;
    cause;
    /**
     * 创建文件读取错误实例
     * @param message 错误消息
     * @param filePath 文件路径
     * @param cause 原始错误（可选）
     */
    constructor(message, filePath, cause) {
        super(message);
        this.filePath = filePath;
        this.cause = cause;
        this.name = 'FileReadError';
        Object.setPrototypeOf(this, FileReadError.prototype);
    }
}
// ============== 工具函数 ==============
/**
 * 根据文件扩展名检测编程语言
 *
 * @param filePath 文件路径
 * @returns 语言名称，未知则返回 undefined
 *
 * @example
 * detectLanguage('src/index.ts')     // 'TypeScript'
 * detectLanguage('styles/main.css')  // 'CSS'
 * detectLanguage('unknown.xyz')      // undefined
 */
export function detectLanguage(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    // 特殊文件名处理
    const fileName = path.basename(filePath).toLowerCase();
    if (fileName === 'dockerfile') {
        return 'Dockerfile';
    }
    if (fileName === 'makefile' || fileName === 'gnumakefile') {
        return 'Makefile';
    }
    if (fileName === '.gitignore' || fileName === '.dockerignore') {
        return 'Ignore File';
    }
    if (fileName === '.editorconfig') {
        return 'EditorConfig';
    }
    return LANGUAGE_MAP[ext];
}
/**
 * 检测是否为二进制文件
 *
 * @param filePath 文件路径
 * @returns 如果是二进制文件返回 true
 *
 * @example
 * isBinaryFile('image.png')  // true
 * isBinaryFile('code.ts')    // false
 */
export function isBinaryFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return BINARY_EXTENSIONS.includes(ext);
}
// ============== 主要函数 ==============
/**
 * 读取单个文件
 *
 * @param filePath 文件路径
 * @param config 安全配置（可选）
 * @returns 文件内容对象
 * @throws FileReadError 当文件读取失败时抛出
 * @throws SecurityError 当安全验证失败时抛出
 *
 * @example
 * const file = await readFile('./src/index.ts');
 * console.log(file.content);  // 文件内容
 * console.log(file.language); // 'TypeScript'
 */
export async function readFile(filePath, config) {
    // 1. 安全验证
    await validatePath(filePath, config);
    // 2. 检查是否为二进制文件
    if (isBinaryFile(filePath)) {
        throw new FileReadError(`无法读取二进制文件: "${filePath}"`, filePath);
    }
    try {
        // 3. 获取绝对路径
        const absolutePath = path.resolve(filePath);
        // 4. 获取文件信息
        const stats = await fs.stat(absolutePath);
        // 5. 验证文件大小
        const maxSize = config?.maxFileSize ?? DEFAULT_SECURITY_CONFIG.maxFileSize;
        await validateFileSize(absolutePath, maxSize);
        // 6. 读取文件内容
        const content = await fs.readFile(absolutePath, 'utf-8');
        // 7. 检测语言
        const language = detectLanguage(filePath);
        return {
            path: filePath,
            absolutePath: absolutePath.replace(/\\/g, '/'),
            content,
            size: stats.size,
            language
        };
    }
    catch (error) {
        // 如果是已知的错误类型，直接抛出
        if (error instanceof FileReadError || error instanceof SecurityError) {
            throw error;
        }
        // 处理其他错误
        const nodeError = error;
        if (nodeError.code === 'ENOENT') {
            throw new FileReadError(`文件不存在: "${filePath}"`, filePath, nodeError);
        }
        if (nodeError.code === 'EACCES') {
            throw new FileReadError(`无权访问文件: "${filePath}"`, filePath, nodeError);
        }
        if (nodeError.code === 'EISDIR') {
            throw new FileReadError(`路径是目录而非文件: "${filePath}"`, filePath, nodeError);
        }
        throw new FileReadError(`读取文件失败: "${filePath}" - ${error.message}`, filePath, error);
    }
}
/**
 * 批量读取多个文件
 * 自动跳过二进制文件和读取失败的文件
 *
 * @param filePaths 文件路径数组
 * @param config 安全配置（可选）
 * @returns 成功读取的文件内容数组
 *
 * @example
 * const files = await readFiles(['./src/a.ts', './src/b.ts']);
 */
export async function readFiles(filePaths, config) {
    const results = [];
    const errors = [];
    // 并行读取所有文件
    const promises = filePaths.map(async (filePath) => {
        try {
            // 跳过二进制文件
            if (isBinaryFile(filePath)) {
                return null;
            }
            const content = await readFile(filePath, config);
            return content;
        }
        catch (error) {
            // 记录错误但不中断
            errors.push({
                path: filePath,
                error: error.message
            });
            return null;
        }
    });
    const settled = await Promise.all(promises);
    // 过滤掉 null 结果
    for (const result of settled) {
        if (result !== null) {
            results.push(result);
        }
    }
    // 如果有错误，输出警告（但不抛出）
    if (errors.length > 0) {
        console.warn(`[file-reader] 跳过 ${errors.length} 个文件:`);
        for (const { path, error } of errors.slice(0, 5)) {
            console.warn(`  - ${path}: ${error}`);
        }
        if (errors.length > 5) {
            console.warn(`  ... 以及其他 ${errors.length - 5} 个文件`);
        }
    }
    return results;
}
/**
 * 读取整个目录
 * 支持 glob 模式过滤，自动排除二进制文件和常见忽略目录
 *
 * @param directory 目录路径
 * @param options 读取选项
 * @returns 文件内容数组
 * @throws SecurityError 当安全验证失败时抛出
 * @throws FileReadError 当目录不存在时抛出
 *
 * @example
 * // 读取所有 TypeScript 文件
 * const files = await readDirectory('./src', {
 *   include: ['**\/*.ts', '**\/*.tsx'],
 *   exclude: ['**\/*.test.ts']
 * });
 */
export async function readDirectory(directory, options) {
    // 1. 安全验证目录路径
    await validatePath(directory, options?.securityConfig);
    // 2. 验证目录是否存在
    const absoluteDir = path.resolve(directory);
    try {
        const stats = await fs.stat(absoluteDir);
        if (!stats.isDirectory()) {
            throw new FileReadError(`路径不是目录: "${directory}"`, directory);
        }
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            throw new FileReadError(`目录不存在: "${directory}"`, directory);
        }
        throw error;
    }
    // 3. 准备 glob 模式
    const include = options?.include || ['**/*'];
    const userExclude = options?.exclude || [];
    // 合并排除模式
    const exclude = [...DEFAULT_EXCLUDE_PATTERNS, ...userExclude];
    // 添加二进制文件扩展名到排除模式
    const binaryExclude = BINARY_EXTENSIONS.map(ext => `**/*${ext}`);
    // 4. 使用 fast-glob 获取文件列表
    const files = await fg(include, {
        cwd: absoluteDir,
        ignore: [...exclude, ...binaryExclude],
        onlyFiles: true,
        dot: false, // 不包含隐藏文件（以 . 开头）
        followSymbolicLinks: false, // 不跟踪符号链接
        absolute: false // 返回相对路径
    });
    // 5. 验证文件数量
    const maxFiles = options?.maxFiles ?? DEFAULT_SECURITY_CONFIG.maxFiles;
    validateFileCount(files.length, maxFiles);
    // 6. 构建完整文件路径
    const filePaths = files.map(file => path.join(directory, file));
    // 7. 读取所有文件
    const contents = await readFiles(filePaths, options?.securityConfig);
    // 8. 调整相对路径（相对于传入的 directory 参数）
    return contents.map(file => ({
        ...file,
        path: path.relative(directory, file.absolutePath).replace(/\\/g, '/')
    }));
}
/**
 * 检查文件是否存在
 *
 * @param filePath 文件路径
 * @returns 如果文件存在返回 true
 */
export async function fileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * 检查目录是否存在
 *
 * @param dirPath 目录路径
 * @returns 如果目录存在返回 true
 */
export async function directoryExists(dirPath) {
    try {
        const stats = await fs.stat(dirPath);
        return stats.isDirectory();
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=file-reader.js.map