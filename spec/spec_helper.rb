require 'webmock/rspec'

$LOAD_PATH.unshift File.expand_path("../../lib", __FILE__)
require "marketplace_kit"

RSpec.configure do |config|
  config.before(:each) do
    stub_const 'MarketplaceKit::MARKETPLACE_BUILDER_FOLDER', 'spec/example_marketplace'
    allow_any_instance_of(Object).to receive(:sleep).and_return(nil)
  end
end
