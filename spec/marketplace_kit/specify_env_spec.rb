describe 'specify env (-e option)' do
  it 'picks proper config scope' do
    stub_request(:get, "http://staging-url.com/api/marketplace_builder/sessions?temporary_token=example-user-token").to_return(status: 200)
    stub_request(:post, 'http://staging-url.com/api/marketplace_builder/marketplace_releases').to_return(status: 200, body: '')

    execute_command('deploy -e staging')
  end

  it 'displays error when passed env is missing' do
    expect { execute_command('deploy -e wrong-name') }.to output(/Error: Invalid env passed!/).to_stdout
  end
end
