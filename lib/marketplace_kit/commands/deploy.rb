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
        wait_for_deploy(response[:body]['id'])
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

      def wait_for_deploy(deploy_id)
        deploy_response = gateway.get_deploy(deploy_id)
        return handle_deploy_result(deploy_response) if deploy_finished?(deploy_response)

        print '.'
        sleep 5
        wait_for_deploy(deploy_id)
      end

      private

      def deploy_finished?(deploy_response)
        %w(success error).include?(deploy_response.body['status'])
      end

      def handle_deploy_result(deploy_response)
        if deploy_response.body['status'] == 'success'
          puts 'success'.green
        else
          parsed_error = JSON.parse(deploy_response.body['error'])
          MarketplaceKit.logger.log_api_error parsed_error['message'], parsed_error['details']
        end
      end

      def is_force_mode
        (@command_args & ['--force', '-f']).any?
      end
    end
  end
end
