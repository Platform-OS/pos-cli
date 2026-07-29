const getConstants = () => {
  return `query getConstants {
    constants(per_page: 99) {
      results { name, value, updated_at }
    }
  }`;
};

const setConstant = (name, value) => {
  return {
    query: `mutation SetConstant($name: String!, $value: String!) {
      constant_set(name: $name, value: $value) {
        name, value
      }
    }`,
    variables: { name, value }
  };
};

const unsetConstant = (name) => {
  return {
    query: `mutation UnsetConstant($name: String!) {
      constant_unset(name: $name) {
        name
      }
    }`,
    variables: { name }
  };
};

export { getConstants, setConstant, unsetConstant };
