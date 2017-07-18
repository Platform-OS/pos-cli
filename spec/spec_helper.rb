require 'webmock/rspec'
require 'simplecov'
SimpleCov.start

$LOAD_PATH.unshift File.expand_path("../../lib", __FILE__)
require "marketplace_kit"
require "helpers/command_executor"
require "helpers/listen_gem_stub"
require "helpers/file_mock"

RSpec.configure do |config|
  config.include Helpers::CommandExecutor
  config.include Helpers::ListenGemStub
  config.include Helpers::FileMock

  config.before(:each) do
    allow_any_instance_of(Object).to receive(:sleep).and_return(nil)
    @fake_listener = stub_listen_gem
  end
end
