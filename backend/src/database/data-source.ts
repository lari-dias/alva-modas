import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { databaseOptions } from './database.options';

config({ path: resolve(__dirname, '..', '..', '.env'), quiet: true });

export default new DataSource(databaseOptions(process.env));
