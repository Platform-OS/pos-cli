require 'json'
require 'listen'
require 'faraday'
require 'dotenv'

require "marketplace_kit/version"
require "marketplace_kit/command_dispatcher"
require "marketplace_kit/services/api_gateway"
require "marketplace_kit/commands/sync"
require "marketplace_kit/commands/deploy"

module MarketplaceKit
  MARKETPLACE_BUILDER_FOLDER = "marketplace_builder"

  def self.root
    File.dirname __dir__
  end

  def self.builder_folder
    "#{Dir.getwd}/#{MARKETPLACE_BUILDER_FOLDER}/"
  end

  def self.load_dotenv
    Dotenv.load("#{MarketplaceKit.builder_folder}/.builder-env.local", "#{MarketplaceKit.builder_folder}/.builder-env")
  end
end

MarketplaceKit.load_dotenv
