module MarketplaceKit
  module Services
    module Loggable
      def log(method_name, *options)
        MarketplaceKit.logger.send(method_name, *options)
      end
    end
  end
end
