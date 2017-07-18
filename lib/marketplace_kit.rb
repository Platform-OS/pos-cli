require 'json'
require 'listen'
require 'faraday'
require 'io/console'
require 'deep_merge/rails_compat'

require "marketplace_kit/version"
require "marketplace_kit/command_dispatcher"
require "marketplace_kit/services/config"
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

  def self.config
    @config ||= Services::Config.new
  end
end
