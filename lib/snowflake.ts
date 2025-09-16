import snowflake from 'snowflake-sdk';

const REQUIRED_ENV = [
  'SNOWFLAKE_ACCOUNT',
  'SNOWFLAKE_USERNAME',
  'SNOWFLAKE_PASSWORD',
] as const;

const ALLOWED_DATABASE = 'VETSTORIA_POC' as const;
const OPTIONAL_ENV_KEYS = [
  'SNOWFLAKE_WAREHOUSE',
  'SNOWFLAKE_DATABASE',
  'SNOWFLAKE_SCHEMA',
  'SNOWFLAKE_ROLE',
] as const;
const PROHIBITED_KEYWORDS = [
  'DELETE',
  'UPDATE',
  'INSERT',
  'MERGE',
  'CALL',
  'ALTER',
  'DROP',
  'TRUNCATE',
  'GRANT',
  'REVOKE',
  'COPY',
  'PUT',
  'REMOVE',
  'USE',
] as const;

const prohibitedRegex = new RegExp(`\b(${PROHIBITED_KEYWORDS.join('|')})\b`, 'i');

function assertEnv(): void {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing Snowflake environment variables: ${missing.join(', ')}`);
  }
}

function assertReadOnlyQuery(sqlText: string): void {
  const normalized = sqlText.trim().replace(/\s+/g, ' ').toUpperCase();

  if (!/^(WITH|SELECT)\b/.test(normalized)) {
    throw new Error('Only SELECT queries are allowed');
  }

  if (normalized.includes(';')) {
    throw new Error('Multiple SQL statements are not permitted');
  }

  if (!normalized.includes(ALLOWED_DATABASE)) {
    throw new Error(`Queries must stay within the ${ALLOWED_DATABASE} database`);
  }

  if (prohibitedRegex.test(normalized)) {
    throw new Error('Mutation statements are not permitted');
  }

  const fullyQualifiedObjects = normalized.matchAll(/\b([A-Z0-9_]+)\.[A-Z0-9_]+\.[A-Z0-9_]+\b/g);
  for (const match of fullyQualifiedObjects) {
    if (match[1] !== ALLOWED_DATABASE) {
      throw new Error(`Access restricted to the ${ALLOWED_DATABASE} database`);
    }
  }
}

type SnowflakeRow = Record<string, unknown>;

type BindParams = Record<string, unknown> | unknown[];

export async function runSnowflakeQuery<T extends SnowflakeRow = SnowflakeRow>(
  sqlText: string,
  binds: BindParams,
): Promise<T[]> {
  assertEnv();
  assertReadOnlyQuery(sqlText);

  const connectionConfig: Partial<snowflake.ConnectionOptions> = {
    account: process.env.SNOWFLAKE_ACCOUNT!,
    username: process.env.SNOWFLAKE_USERNAME!,
    password: process.env.SNOWFLAKE_PASSWORD!,
  } as Partial<snowflake.ConnectionOptions>;


  for (const key of OPTIONAL_ENV_KEYS) {
    const value = process.env[key];
    if (value) {
      const optionKey = key.replace('SNOWFLAKE_', '').toLowerCase() as keyof snowflake.ConnectionOptions;
      connectionConfig[optionKey] = value;
    }
  }

  const connection = snowflake.createConnection(connectionConfig as snowflake.ConnectionOptions);

  await connect(connection);

  try {
    const rows = await execute<T>(connection, sqlText, binds);
    return rows;
  } finally {
    await destroy(connection);
  }
}

function connect(connection: snowflake.Connection): Promise<void> {
  return new Promise((resolve, reject) => {
    connection.connect((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

function destroy(connection: snowflake.Connection): Promise<void> {
  return new Promise((resolve) => {
    connection.destroy((error) => {
      if (error) {
        console.error('Failed to close Snowflake connection', error);
      }
      resolve();
    });
  });
}

function execute<T>(
  connection: snowflake.Connection,
  sqlText: string,
  binds: BindParams,
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    connection.execute({
      sqlText,
      binds,
      complete(error, _statement, rows) {
        if (error) {
          reject(error);
          return;
        }
        resolve((rows ?? []) as T[]);
      },
    });
  });
}

