module MarketplaceKit
  module Services
    class ApiGateway
      def login(email, password)
        response = send(:post, 'sessions', { email: email, password: password })
        raise('Error: Invalid email or password!') if response.status == 401

        response.body['token']
      end

      def login_required?
        response = send(:get, "sessions?temporary_token=#{MarketplaceKit.config.token}")
        response.body['login_required']
      end

      def send_file_change(file_path, file_content)
        send(:put, 'marketplace_releases/sync', { path: file_path, marketplace_builder_file_body: file_content })
      end

      def deploy(zip_file_path, deploy_options)
        upload_file = Faraday::UploadIO.new(zip_file_path, 'application/zip')
        send(:post, 'marketplace_releases', { marketplace_builder: { zip_file: upload_file, force_mode: deploy_options[:force] } }, multipart: true)
      end

      private

      def send(request_type, url, body = {}, options = {})
        ApiDriver.new(request_type, url, body, options).send_request
      end
    end
  end
end
