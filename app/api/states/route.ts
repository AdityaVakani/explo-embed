import { NextRequest, NextResponse } from 'next/server';

import { isAllowedOrigin, rateLimit } from '@/lib/security';
import { runSnowflakeQuery } from '@/lib/snowflake';
import { getClientIp } from '@/lib/utils';

const STATES_SQL = `
SELECT DISTINCT UPPER(STATE) AS STATE
FROM VET_CLINIC_HOSPITAL.PUBLIC.CLINICS_MASTER
WHERE STATE IS NOT NULL AND TRIM(STATE) <> ''
ORDER BY STATE
`;

type StateRow = {
  STATE: string | null;
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const ip = getClientIp(request.headers);
  if (!rateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too Many Requests' },
      {
        status: 429,
        headers: {
          'Retry-After': '60',
        },
      },
    );
  }

  try {
    const rows = await runSnowflakeQuery<StateRow>(STATES_SQL, []);
    const states = rows
      .map((row) => row.STATE)
      .filter((value): value is string => typeof value === 'string' && value.length > 0);

    return NextResponse.json({ states });
  } catch (error) {
    console.error('Failed to load states', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
