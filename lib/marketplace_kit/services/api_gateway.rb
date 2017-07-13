module MarketplaceKit
  module Services
    class ApiGateway
      def send_file_change(file_path, file_content)
        connection.put("api/marketplace_releases/sync", { 
          path: file_path, 
          body: file_content
        }.to_json)
      end

      private

      def connection
        @connection ||= Faraday.new(
          url: 'http://localhost:3000', 
          headers: { 'Content-Type' => 'application/json' }
        )
      end
    end
  end
end
