const getConstants = () => {
  return `query getConstants {
    constants(per_page: 99) {
      results { name, value, updated_at }
    }
  }`;
};

const setConstant = (name, value) => {
  return `mutation {
    constant_set(name: "${name}", value: "${value}") {
      name, value
    }
  }`;
};

const unsetConstant = (name) => {
  return `mutation {
    constant_unset(name: "${name}") {
      name
    }
  }`;
}

export { getConstants, setConstant, unsetConstant };
