require 'json'
require 'listen'
require 'faraday'

require "marketplace_kit/version"
require "marketplace_kit/command_dispatcher"
require "marketplace_kit/commands/sync"

module MarketplaceKit
  MARKETPLACE_BUILDER_FOLDER = "marketplace_builder/"

  def self.root
    File.dirname __dir__
  end
end
