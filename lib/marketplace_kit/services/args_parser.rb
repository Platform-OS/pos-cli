module MarketplaceKit
  module Services
    class ArgsParser
      def initialize(args)
        @args = args
      end

      def command_name
        @args[0]
      end

      def command_args
        @args[1..-1] || []
      end
    end
  end
end
