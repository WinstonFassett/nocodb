import fs from 'fs';
import { promisify } from 'util';
import Noco from '../../../Noco';
import SqlClientFactoryEE from './ee/SqlClientFactoryEE';
import MySqlClient from './mysql/MysqlClient';
import MssqlClient from './mssql/MssqlClient';
import OracleClient from './oracle/OracleClient';
import SqliteClient from './sqlite/SqliteClient';
import PgClient from './pg/PgClient';
import YugabyteClient from './pg/YugabyteClient';
import TidbClient from './mysql/TidbClient';
import VitessClient from './mysql/VitessClient';

export class SqlClientFactory {
  static create(connectionConfig) {
    connectionConfig.meta = connectionConfig.meta || {};
    connectionConfig.pool = connectionConfig.pool || { min: 0, max: 5 };
    connectionConfig.meta.dbtype = connectionConfig.meta.dbtype || '';
    if (
      connectionConfig.client === 'mysql' ||
      connectionConfig.client === 'mysql2'
    ) {
      if (connectionConfig.meta.dbtype === 'tidb')
        return new TidbClient(connectionConfig);
      if (connectionConfig.meta.dbtype === 'vitess')
        return new VitessClient(connectionConfig);
      return new MySqlClient(connectionConfig);
    } else if (connectionConfig.client === 'sqlite3') {
      return new SqliteClient(connectionConfig);
    } else if (connectionConfig.client === 'mssql') {
      return new MssqlClient(connectionConfig);
    } else if (connectionConfig.client === 'oracledb') {
      return new OracleClient(connectionConfig);
    } else if (connectionConfig.client === 'pg') {
      if (connectionConfig.meta.dbtype === 'yugabyte')
        return new YugabyteClient(connectionConfig);
      return new PgClient(connectionConfig);
    }

    throw new Error('Database not supported');
  }
}

export default class {
  static async create(connectionConfig) {
    if (
      connectionConfig.connection.ssl &&
      typeof connectionConfig.connection.ssl === 'object'
    ) {
      if (connectionConfig.connection.ssl.caFilePath) {
        connectionConfig.connection.ssl.ca = await promisify(fs.readFile)(
          connectionConfig.connection.ssl.caFilePath
        ).toString();
      }
      if (connectionConfig.connection.ssl.keyFilePath) {
        connectionConfig.connection.ssl.key = await promisify(fs.readFile)(
          connectionConfig.connection.ssl.keyFilePath
        ).toString();
      }
      if (connectionConfig.connection.ssl.certFilePath) {
        connectionConfig.connection.ssl.cert = await promisify(fs.readFile)(
          connectionConfig.connection.ssl.certFilePath
        ).toString();
      }
    }

    if (Noco.isEE()) {
      return SqlClientFactoryEE.create(connectionConfig);
    }

    return SqlClientFactory.create(connectionConfig);
  }
}
