module MarketplaceKit
  module Commands
    class Deploy < BaseCommand
      def execute
        puts "Deploy command started!"
        ensure_tmp_folder_exist

        puts 'Compressing marketplace_builder folder'
        zip_marketplace_builder_directory

        puts 'Sending zip to the server'
        send_zip_to_server
      end

      protected

      def ensure_tmp_folder_exist
        Dir.mkdir('tmp') unless File.exists?('tmp')
      end

      def zip_marketplace_builder_directory
        system "rm #{Dir.getwd}/tmp/marketplace_builder.zip"
        system "cd #{MarketplaceKit::MARKETPLACE_BUILDER_FOLDER}; zip -r #{Dir.getwd}/tmp/marketplace_builder.zip ."
      end

      def send_zip_to_server
        gateway.deploy("#{Dir.getwd}/tmp/marketplace_builder.zip", force: true)
      end
    end
  end
end
