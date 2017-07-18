module MarketplaceKit
  module Services
    class Config
      def initialize
        @config = {}
      end

      def load
        raw_config = File.read("#{MarketplaceKit.builder_folder}/.builder")

        @config = JSON.parse(raw_config)
      end

      def token
        @config["localhost"]['token'].to_s
      end

      def set_token(value)
        @config['localhost']['token'] = value
      end

      def url
        @config['localhost']['url'].to_s
      end
    end
  end
end
