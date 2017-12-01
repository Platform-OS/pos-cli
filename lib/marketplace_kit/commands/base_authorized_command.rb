module MarketplaceKit
  module Commands
    class BaseAuthorizedCommand < BaseCommand
      def initialize(command_args)
        @command_args = command_args
        authenticate
      end

      protected

      def ensure_tmp_folder_exist
        Dir.mkdir('tmp') unless File.exist?('tmp')
      end

      def gateway
        @gateway ||= Services::ApiGateway.new
      end

      def authenticate
        MarketplaceKit.config.load current_env
        user_authentication.authenticate
      end

      def current_env
        endpoint_arg_value || MarketplaceKit.config.default_endpoint
      end

      def endpoint_arg_index
        @endpoint_arg_index ||= @command_args.find_index { |arg| arg == '-e' }
      end

      def endpoint_arg_value
        endpoint_arg_index && @command_args[endpoint_arg_index + 1]
      end

      def user_authentication
        @user_authentication ||= Services::UserAuthentication.new
      end
    end
  end
end
