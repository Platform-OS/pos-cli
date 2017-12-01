module MarketplaceKit
  module Commands
    class ShowHelp < BaseCommand
      include Services::Loggable

      def execute
        ShowVersion.new(nil).execute
        log :usage
      end
    end
  end
end
