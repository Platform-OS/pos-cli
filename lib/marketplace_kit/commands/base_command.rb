module MarketplaceKit
  module Commands
    class BaseCommand
      include Services::Loggable

      def initialize(command_args)
        @command_args = command_args
      end
    end
  end
end
