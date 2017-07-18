describe "login" do
  context "when no token stored" do
    before(:each) do
      allow(File).to receive(:read).with("#{MarketplaceKit.builder_folder}/.builder").and_return('{
        "localhost": {
          "url": "http://localhost:3000"
        }
      }')

      allow(STDIN).to receive(:gets).and_return('correct-email')
      allow(STDIN).to receive(:noecho).and_return('correct-password')

      stub_request(:post, "http://localhost:3000/api/marketplace_builder/sessions").with(body: {
        email: 'correct-email',
        password: 'correct-password'
      }).to_return(status: 200, body: { token: 'example-user-token' }.to_json)

      stub_request(:post, "http://localhost:3000/api/marketplace_builder/sessions").with(body: {
        email: 'correct-email',
        password: 'wrong-password'
      }).to_return(status: 401, body: {}.to_json)

      stub_request(:post, 'http://localhost:3000/api/marketplace_releases').to_return(status: 200)
    end

    it 'asks for login and password' do
      expect(STDIN).to receive(:gets).and_return('correct-email')
      expect(STDIN).to receive(:noecho).and_return('correct-password')

      execute_command('deploy')
    end

    it 'sends API request to login' do
      execute_command('deploy')

      expect(a_request(:post, "http://localhost:3000/api/marketplace_builder/sessions").with( body: {
        email: 'correct-email',
        password: 'correct-password'
      }.to_json)).to have_been_made
    end

    it 'continues command if login was success' do
      expect { execute_command('deploy') }.to output(/Deploy command started/).to_stdout

      expect(a_request(:post, "http://localhost:3000/api/marketplace_releases").with(headers: {
        'UserTemporaryToken' => 'example-user-token',
      })).to have_been_made
    end

    it 'aborts command if login failed' do
      expect(STDIN).to receive(:gets).and_return('correct-email')
      expect(STDIN).to receive(:noecho).and_return('wrong-password')

      expect{execute_command('deploy') }.to raise_error('Error: Invalid email or password!')
    end

    it 'stores token after login' do
      expect(STDIN).to receive(:gets).and_return('correct-email').twice
      expect(STDIN).to receive(:noecho).and_return('correct-password').twice

      execute_command('deploy')
      execute_command('deploy')
    end
  end
end
