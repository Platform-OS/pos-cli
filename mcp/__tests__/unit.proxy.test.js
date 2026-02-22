const ProxyWrapper = require('../proxy-wrapper');

describe('ProxyWrapper', () => {
  const proxy = new ProxyWrapper();

  test('call returns echo', async () => {
    const res = await proxy.call({ tool: 'echo', args: 'x' });
    expect(res).toHaveProperty('echoed', 'x');
  });

  test('call with unknown tool returns called', async () => {
    const res = await proxy.call({ tool: 'foo' });
    expect(res).toHaveProperty('called', 'foo');
  });

  test('call throws on invalid payload', async () => {
    await expect(proxy.call(null)).rejects.toThrow('invalid payload');
  });

  test('callStream yields chunks', async () => {
    const chunks = [];
    for await (const c of proxy.callStream({ tool: 'echo', args: 's' })) {
      chunks.push(c);
    }
    expect(chunks.length).toBe(3);
    expect(chunks[0]).toHaveProperty('seq', 0);
  });
});
