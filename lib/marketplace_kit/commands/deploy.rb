module MarketplaceKit
  module Commands
    class Deploy
      def execute
        puts "Deploy command started!"

        ensure_tmp_folder_exist
        zip_marketplace_builder_directory
        send_zip_to_server
      end

      protected

      def ensure_tmp_folder_exist
        Dir.mkdir('tmp') unless File.exists?('tmp')
      end

      def zip_marketplace_builder_directory
        puts 'Compressing marketplace_builder folder'

        system "rm #{Dir.getwd}/tmp/marketplace_builder.zip"
        system "cd #{MarketplaceKit::MARKETPLACE_BUILDER_FOLDER}; zip -r #{Dir.getwd}/tmp/marketplace_builder.zip ."
      end

      def send_zip_to_server
        gateway.deploy("#{Dir.getwd}/tmp/marketplace_builder.zip", force: true)
      end

      private

      def gateway
        @gateway ||= Services::ApiGateway.new
      end
    end
  end
end
