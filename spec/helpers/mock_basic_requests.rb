RSpec.configure do |config|
  config.before(:each) do
    stub_request(:get, 'http://localhost:3000/api/marketplace_builder/sessions?temporary_token=example-user-token')
      .to_return(status: 200, body: { login_required: false }.to_json)

    stub_request(:get, 'http://localhost:3000/api/marketplace_builder/sessions?temporary_token=expired-token')
      .to_return(status: 200, body: { login_required: true }.to_json)

    stub_request(:get, 'http://localhost:3000/api/marketplace_builder/marketplace_releases/1')
      .to_return(status: 200, body: { id: 1, status: 'success', zip_file: { url: 'http://fake-zip-file-url.com' } }.to_json)
  end
end
