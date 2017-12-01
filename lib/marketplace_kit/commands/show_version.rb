module MarketplaceKit
  module Commands
    class ShowVersion < BaseCommand
      include Services::Loggable

      def execute
        log :version, MarketplaceKit::VERSION
      end
    end
  end
end
