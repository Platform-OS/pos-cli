module MarketplaceKit
  module Commands
    class BaseCommand
      def initialize(command_args)
        @command_args = command_args
      end

      protected

      def ensure_tmp_folder_exist
        Dir.mkdir('tmp') unless File.exist?('tmp')
      end

      def gateway
        @gateway ||= Services::ApiGateway.new
      end
    end
  end
end
