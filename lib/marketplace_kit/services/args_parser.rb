module MarketplaceKit
  module Services
    class ArgsParser
      DEFAULT_ENV = 'localhost'

      def initialize(args)
        @args = args
      end

      def command_name
        @args[0]
      end

      def command_args
        @args[1..-1] || []
      end

      def current_env
        return DEFAULT_ENV unless e_arg_index
        env_arg_value || DEFAULT_ENV
      end

      private

      def e_arg_index
        @e_arg_index ||= command_args.find_index { |arg| arg == '-e' }
      end

      def env_arg_value
        command_args[e_arg_index + 1]
      end
    end
  end
end
