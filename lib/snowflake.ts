import snowflake from 'snowflake-sdk';

const REQUIRED_ENV = [
  'SNOWFLAKE_ACCOUNT',
  'SNOWFLAKE_USERNAME',
  'SNOWFLAKE_PASSWORD',
] as const;

const OPTIONAL_ENV_MAP = {
  SNOWFLAKE_WAREHOUSE: 'warehouse',
  SNOWFLAKE_DATABASE: 'database',
  SNOWFLAKE_SCHEMA: 'schema',
  SNOWFLAKE_ROLE: 'role',
} as const;

type SnowflakeRow = Record<string, unknown>;

type BindParams = Record<string, unknown> | unknown[];

function assertEnv(): void {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing Snowflake environment variables: ${missing.join(', ')}`);
  }
}

export async function runSnowflakeQuery<T extends SnowflakeRow = SnowflakeRow>(
  sqlText: string,
  binds: BindParams,
): Promise<T[]> {
  assertEnv();

  const connectionConfig: Record<string, unknown> = {
    account: process.env.SNOWFLAKE_ACCOUNT!,
    username: process.env.SNOWFLAKE_USERNAME!,
    password: process.env.SNOWFLAKE_PASSWORD!,
  };

  for (const key of Object.keys(OPTIONAL_ENV_MAP) as Array<keyof typeof OPTIONAL_ENV_MAP>) {
    const value = process.env[key];
    const optionKey = OPTIONAL_ENV_MAP[key];
    if (value && optionKey) {
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
