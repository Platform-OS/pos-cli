module MarketplaceKit
  module Commands
    class BaseCommand
      protected

      def gateway
        @gateway ||= Services::ApiGateway.new
      end
    end
  end
end
