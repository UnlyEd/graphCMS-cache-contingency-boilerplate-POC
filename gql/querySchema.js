import gql from 'graphql-tag';

export const querySchemaData = gql`
  query {
    __schema {
      mutationType {
        kind
      }
    }
  }
`;

export const querySchemaData2 = gql`
  query {
    __schema {
      mutationType {
        description
        enumValues {
          isDeprecated
        }
      }
    }
  }
`;
