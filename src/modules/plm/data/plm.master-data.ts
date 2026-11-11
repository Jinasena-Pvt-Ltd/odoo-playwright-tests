/** Static test configuration for the plm module (tour PLM_1). */
export const PLM_TEST_CONFIG = {
  // Tour product (JMC10D). The spec never revises the real product: it builds a
  // throw-away "[TEST]" product + BOM through RPC and revises that instead.
  tourProductCode: 'JMC10D',
  // Component added in the revision (tour: [02BB 023] BALL BEARING 6202-2RS).
  addedComponentCode: '02BB 023',
  oldQty: 20,
  newQty: 18,
  ecoTypeName: 'BOM Updates',
};
