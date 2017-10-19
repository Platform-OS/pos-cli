module MarketplaceKit
  module Services
    class ApiGateway
      def login(email, password)
        response = send_request(:post, 'sessions', email: email, password: password)
        raise Errors::MarketplaceError.new('Error: Invalid email or password!') if response.status == 401

        response.body['token']
      end

      def login_required?
        response = send_request(:get, "sessions?temporary_token=#{MarketplaceKit.config.token}")
        raise Errors::MarketplaceError.new('Login failed.') unless response.success?

        response.body['login_required']
      end

      def send_file_change(file_path, file_content)
        send_request(:put, 'marketplace_releases/sync', path: file_path, marketplace_builder_file_body: file_content)
      end

      def get_deploy(deploy_id)
        send_request(:get, "marketplace_releases/#{deploy_id}")
      end

      def deploy(zip_file_path, force:, manifest:)
        upload_file = Faraday::UploadIO.new(zip_file_path, 'application/zip')
        send_request(
          :post,
          'marketplace_releases',
          {
            marketplace_builder: {
              zip_file: upload_file,
              force_mode: force,
              manifest: manifest
            }
          },
          multipart: true
        )
      end

      def backup
        send_request(:post, 'marketplace_releases/backup', {})
      end

      def settings
        send_request(:get, 'settings')
      end

      private

      def send_request(request_type, url, body = {}, options = {})
        ApiDriver.new(request_type, url, body, options).send_request
      end
    end
  end
end
