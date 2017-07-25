require 'webmock/rspec'
require 'simplecov'
SimpleCov.start

$LOAD_PATH.unshift File.expand_path('../../lib', __FILE__)
require 'marketplace_kit'
require 'helpers/command_executor'
require 'helpers/listen_gem_stub'
require 'helpers/file_mock'

RSpec.configure do |config|
  config.include Helpers::CommandExecutor
  config.include Helpers::ListenGemStub
  config.include Helpers::FileMock

  config.before(:each) do
    allow_any_instance_of(Object).to receive(:sleep).and_return(nil)
    @fake_listener = stub_listen_gem

    stub_request(:get, 'http://localhost:3000/api/marketplace_builder/sessions?temporary_token=example-user-token')
      .to_return(status: 200, body: { login_required: false }.to_json)

    stub_request(:get, 'http://localhost:3000/api/marketplace_builder/sessions?temporary_token=expired-token')
      .to_return(status: 200, body: { login_required: true }.to_json)

    stub_request(:get, 'http://localhost:3000/api/marketplace_builder/marketplace_releases/1')
      .to_return(status: 200, body: { id: 1, status: 'success' }.to_json)
  end
end
