require 'json'
require 'listen'
require 'faraday'

require "marketplace_kit/version"
require "marketplace_kit/command_dispatcher"
require "marketplace_kit/services/api_gateway"
require "marketplace_kit/commands/sync"
require "marketplace_kit/commands/deploy"

module MarketplaceKit
  MARKETPLACE_BUILDER_FOLDER = "marketplace_builder/"

  def self.root
    File.dirname __dir__
  end
end
