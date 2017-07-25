module MarketplaceKit
  module Commands
    class Deploy < BaseCommand
      def execute
        puts 'Deploy command started!'.green
        ensure_tmp_folder_exist

        puts 'Compressing marketplace_builder folder'.yellow
        zip_marketplace_builder_directory

        puts 'Sending zip to the server'.yellow
        response = send_zip_to_server
        return unless response.success?

        puts 'Waiting for deploy to finish'.yellow
        wait_for_deploy(response)
      end

      protected

      def ensure_tmp_folder_exist
        Dir.mkdir('tmp') unless File.exist?('tmp')
      end

      def zip_marketplace_builder_directory
        system "rm #{Dir.getwd}/tmp/marketplace_builder.zip"
        system "cd #{MarketplaceKit::MARKETPLACE_BUILDER_FOLDER}; zip -r #{Dir.getwd}/tmp/marketplace_builder.zip ."
      end

      def send_zip_to_server
        gateway.deploy("#{Dir.getwd}/tmp/marketplace_builder.zip", force: is_force_mode)
      end

      def wait_for_deploy(response)
        deploy_id = response[:body]['id']
        deploy_response = gateway.get_deploy(deploy_id)

        if deploy_response.body['status'] == 'ready_for_import'
          print '.'
          sleep 5
          wait_for_deploy(deploy_response)
        else
          if deploy_response.body['status'] == 'success'
            puts 'success'.green
          else
            puts '```'.red
            puts "Builder error: #{JSON.parse(deploy_response.body['error'])['message']}".red
            puts 'Details:'
            puts JSON.parse(deploy_response.body['error'])['details']
            puts '```'.red
          end
        end
      end

      private

      def is_force_mode
        (@command_args& ['--force', '-f']).any?
      end
    end
  end
end
