module MarketplaceKit
  module Commands
    class Deploy
      def execute
        puts "Deploy command started!"
        zip_marketplace_builder_directory

        file = Faraday::UploadIO.new("#{Dir.getwd}/tmp/marketplace_builder.zip", 'application/zip')
        connection.post('api/marketplace_releases', marketplace_builder: { zip_file: file, force_mode:  true})
      end

      private

      def zip_marketplace_builder_directory
        puts 'Compressing marketplace_builder folder'

        Dir.mkdir('tmp') unless File.exists?('tmp')
        system "rm #{Dir.getwd}/tmp/marketplace_builder.zip"
        system "cd #{MarketplaceKit::MARKETPLACE_BUILDER_FOLDER}; zip -r #{Dir.getwd}/tmp/marketplace_builder.zip ."
      end

      def connection
        @connection ||= Faraday.new(faraday_basic_hash) do |conn|
          conn.request :multipart
          conn.request :url_encoded
          conn.adapter :net_http
        end
      end

      def faraday_basic_hash
        {
          url: 'http://localhost:3000'
        }
      end
    end
  end
end
