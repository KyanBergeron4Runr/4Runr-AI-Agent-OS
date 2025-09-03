"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.features = exports.isTest = exports.isProduction = exports.isDevelopment = exports.env = void 0;
exports.parseEnv = parseEnv;
exports.validateRequiredEnv = validateRequiredEnv;
exports.getSafeEnvForLogging = getSafeEnvForLogging;
const zod_1 = require("zod");
const dotenv = __importStar(require("dotenv"));
const path_1 = __importDefault(require("path"));
const envPath = path_1.default.resolve(process.cwd(), 'infra', '.env');
dotenv.config({ path: envPath });
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    PORT: zod_1.z.string().transform(Number).default('3000'),
    HOST: zod_1.z.string().default('127.0.0.1'),
    DATABASE_URL: zod_1.z.string().url(),
    REDIS_URL: zod_1.z.string().url().optional(),
    JWT_SECRET: zod_1.z.string().min(32),
    ENCRYPTION_KEY: zod_1.z.string().min(32),
    SENTINEL_STORE_PLAIN: zod_1.z.string().transform(val => val === 'true').default('true'),
    SENTINEL_MODE: zod_1.z.enum(['live', 'mock']).default('live'),
    SENTINEL_SHIELD_MODE: zod_1.z.enum(['enforce', 'monitor', 'off']).default('enforce'),
    LOG_LEVEL: zod_1.z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    DEV_MODE: zod_1.z.string().transform(val => val === 'true').default('false'),
    ALLOW_LOCALHOST_ONLY: zod_1.z.string().transform(val => val === 'true').default('true'),
});
function parseEnv() {
    try {
        return envSchema.parse(process.env);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            console.error('❌ Environment validation failed:');
            error.errors.forEach(err => {
                console.error(`   ${err.path.join('.')}: ${err.message}`);
            });
            console.error(`\n📝 Please check infra/.env.example and create infra/.env`);
            process.exit(1);
        }
        throw error;
    }
}
exports.env = parseEnv();
exports.isDevelopment = exports.env.NODE_ENV === 'development';
exports.isProduction = exports.env.NODE_ENV === 'production';
exports.isTest = exports.env.NODE_ENV === 'test';
exports.features = {
    sentinel: {
        enabled: exports.env.SENTINEL_MODE === 'live',
        storePlain: exports.env.SENTINEL_STORE_PLAIN,
        shieldMode: exports.env.SENTINEL_SHIELD_MODE,
    },
    development: {
        devMode: exports.env.DEV_MODE,
        localhostOnly: exports.env.ALLOW_LOCALHOST_ONLY,
    }
};
function validateRequiredEnv(required) {
    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
}
function getSafeEnvForLogging() {
    return {
        NODE_ENV: exports.env.NODE_ENV,
        PORT: exports.env.PORT,
        HOST: exports.env.HOST,
        DATABASE_URL: exports.env.DATABASE_URL ? '***configured***' : '***missing***',
        REDIS_URL: exports.env.REDIS_URL ? '***configured***' : '***missing***',
        SENTINEL_MODE: exports.env.SENTINEL_MODE,
        SENTINEL_SHIELD_MODE: exports.env.SENTINEL_SHIELD_MODE,
        LOG_LEVEL: exports.env.LOG_LEVEL,
        DEV_MODE: exports.env.DEV_MODE,
    };
}
//# sourceMappingURL=env.js.map