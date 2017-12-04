module MarketplaceKit
  module Commands
    class Deploy < BaseAuthorizedCommand
      def execute
        log :deploy_started
        ensure_tmp_folder_exist

        log :compressing_folder
        zip_marketplace_builder_directory

        log :sending_zip
        response = send_zip_to_server
        return unless response.success?

        log :wait_for_deploy_finish
        wait_for_deploy(response[:body]['id'])
      end

      protected

      def zip_marketplace_builder_directory
        system "rm #{Dir.getwd}/tmp/marketplace_builder.zip"
        force_mode? ? zip_all_files : zip_files_without_old_assets
      end

      def zip_files_without_old_assets
        files_path = changed_files.map { |path| path.gsub(%r{^\/}, '') }
        File.open('tmp/files_to_zip.txt', 'w+') { |file| file.puts files_path }
        system "cd #{MarketplaceKit::MARKETPLACE_BUILDER_FOLDER}; zip #{root}/tmp/marketplace_builder.zip -@ < #{root}/tmp/files_to_zip.txt"
      end

      def zip_all_files
        system "cd #{MarketplaceKit::MARKETPLACE_BUILDER_FOLDER}; zip -r #{root}/tmp/marketplace_builder.zip ."
      end

      def send_zip_to_server
        gateway.deploy("#{root}/tmp/marketplace_builder.zip", force: force_mode?, manifest: manifest)
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
        print "\n"
        if deploy_response.body['status'] == 'success'
          log :deploy_succeeded
        else
          parsed_error = JSON.parse(deploy_response.body['error'])
          log :api_error, parsed_error['message'], parsed_error['details']
        end
      end

      def force_mode?
        (@command_args & ['--force', '-f']).any?
      end

      def manifest
        Dir.glob("marketplace_builder/**/*")
           .select { |path| File.file?(path) }
           .map { |path| [path.gsub('marketplace_builder', ''), { 'md5' => Digest::MD5.hexdigest(File.read(path)) }] }
           .to_h
      end

      def root
        Dir.getwd
      end

      def changed_files
        ListChangedFiles.new(manifest, gateway.settings.body).call.keys
      end

      class ListChangedFiles
        def initialize(manifest, settings)
          @manifest = manifest
          @settings = settings
        end

        def call
          @manifest.reject do |path, meta|
            path.start_with?('/custom_themes/') &&
              manifest_on_server[path] &&
              manifest_on_server[path]['md5'] == meta['md5']
          end
        end

        private

        def manifest_on_server
          @manifest_on_server ||= @settings['manifest']
        end
      end
    end
  end
end
