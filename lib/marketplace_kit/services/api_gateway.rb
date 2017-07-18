module MarketplaceKit
  module Services
    class ApiGateway
      def login(email, password)
        response = json_connection.post("api/marketplace_builder/sessions", { 
          email: email, 
          password: password
        }.to_json)

        { status: response.status, body: JSON.parse(response.body) }
      end

      def send_file_change(file_path, file_content)
        json_connection.put("api/marketplace_releases/sync", { 
          path: file_path, 
          body: file_content
        }.to_json)
      end

      def deploy(zip_file_path, deploy_options)
        upload_file = Faraday::UploadIO.new(zip_file_path, 'application/zip')
        multipart_connection.post('api/marketplace_releases', marketplace_builder: { zip_file: upload_file, force_mode: deploy_options[:force]})
      end

      private

      def json_connection
        @json_connection ||= Faraday.new(faraday_basic_configuration.merge(
          headers: { 
            'Content-Type' => 'application/json',
            'UserTemporaryToken' => MarketplaceKit.config.token,
            'Accept' => 'application/vnd.nearme.v4+json'
          }
        ))
      end

      def multipart_connection
        @multipart_connection ||= Faraday.new(faraday_basic_configuration.merge(
          headers: {
            'UserTemporaryToken' => MarketplaceKit.config.token,
            'Accept' => 'application/vnd.nearme.v4+json'
          }
        )) do |conn|
          conn.request :multipart
          conn.request :url_encoded
          conn.adapter :net_http
        end
      end

      def faraday_basic_configuration
        {
          url: MarketplaceKit.config.url,
          headers: {}
        }
      end
    end
  end
end
