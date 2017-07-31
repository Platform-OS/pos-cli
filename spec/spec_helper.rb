require 'webmock/rspec'
require 'simplecov'
require 'coveralls'
Coveralls.wear!
SimpleCov.start

$LOAD_PATH.unshift File.expand_path('../../lib', __FILE__)
require 'marketplace_kit'
Dir["#{File.dirname(__FILE__)}/helpers/**/*.rb"].each { |file| require file }

RSpec.configure do |config|
  config.include Helpers::ListenGemStub
  config.include Helpers::FileMock
  config.include Helpers::CommandExecutor

  config.before(:each) do
    @fake_listener = stub_listen_gem
  end
end
