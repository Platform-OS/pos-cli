const posInstance =  {
    MPKIT_URL: ''
};

fetch('http://localhost:3333/info').then(data => data.json()).then(info => {
    posInstance.MPKIT_URL = info.MPKIT_URL;
})


export { posInstance };