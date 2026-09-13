/** TypeORM이 감싼 MySQL UNIQUE 위반만 식별한다. */
export function isMysqlDuplicateKey(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('driverError' in error)) return false;
  const driver = error.driverError;
  return (
    typeof driver === 'object' &&
    driver !== null &&
    (('errno' in driver && driver.errno === 1062) ||
      ('code' in driver && driver.code === 'ER_DUP_ENTRY'))
  );
}
