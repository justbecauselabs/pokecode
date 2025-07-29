import { config } from './src/config';
export default {
    schema: './src/db/schema/*',
    out: './drizzle',
    driver: 'pg',
    dbCredentials: {
        host: config.DB_HOST,
        port: config.DB_PORT,
        user: config.DB_USER,
        password: config.DB_PASSWORD,
        database: config.DB_NAME,
    },
};
//# sourceMappingURL=drizzle.config.js.map