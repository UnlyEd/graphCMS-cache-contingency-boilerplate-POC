export const responseSchemaData = {
  'data': {
    '__schema': {
      '__typename': '__Schema',
      'mutationType': {
        '__typename': '__Type',
        'kind': 'OBJECT',
      },
    },
  },
  'loading': false,
  'networkStatus': 7,
  'stale': false,
};

export const eventExample = {
  body: `{"operationName":null,"variables":{},"query":"{__schema { mutationType { kind }}}"}`,
};

describe('utils/queries.test.js', () => {
  describe('values used for tests', () => {
    test('must be compliant and good formated data', async () => {
      expect(JSON.stringify(eventExample)).toBe("{\"body\":\"{\\\"operationName\\\":null,\\\"variables\\\":{},\\\"query\\\":\\\"{__schema { mutationType { kind }}}\\\"}\"}");
    });
  });
});
