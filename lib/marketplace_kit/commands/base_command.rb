module MarketplaceKit
  module Commands
    class BaseCommand
      def initialize(command_args)
        @command_args = command_args
      end

      protected

      def gateway
        @gateway ||= Services::ApiGateway.new
      end
    end
  end
end
