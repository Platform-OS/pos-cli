require 'webmock/rspec'
require 'simplecov'
SimpleCov.start

$LOAD_PATH.unshift File.expand_path("../../lib", __FILE__)
require "marketplace_kit"
require "helpers/command_executor"
require "helpers/listen_gem_stub"

RSpec.configure do |config|
  config.include Helpers::CommandExecutor
  config.include Helpers::ListenGemStub

  config.before(:each) do
    stub_const 'MarketplaceKit::MARKETPLACE_BUILDER_FOLDER', 'spec/example_marketplace'
    allow_any_instance_of(Object).to receive(:sleep).and_return(nil)
    @fake_listener = stub_listen_gem
  end
end
