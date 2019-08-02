import gql from 'graphql-tag';

export const querySchemaData = gql`
    query {
        sites {
            status
            url
        }
    }
`;

export const querySchemaData2 = gql`
    query {
        sites {
            id
            url
        }
    }
`;
