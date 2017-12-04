module MarketplaceKit
  module Services
    class ApiDriver
      include Loggable

      def initialize(request_type, url, hash_body, options)
        @request_type = request_type
        @url = url
        @hash_body = hash_body
        @options = options
      end

      def send_request
        url = "api/marketplace_builder/#{@url}"
        body = prepare_body_to_send

        response = connection.method(@request_type).call(url, body)
        parsed_response = JSON.parse(response.body)

        raise Errors::ApiError.new(parsed_response) unless response.success?
        OpenStruct.new(status: response.status, body: parsed_response, success?: true)
      rescue StandardError => e
        log_error(e, response)
        OpenStruct.new(status: (response && response.status), body: parsed_response, success?: false)
      end

      private

      def log_error(error, response)
        if error.is_a?(JSON::ParserError)
          log :json_error, response.body
        elsif error.is_a?(Errors::ApiError)
          log :api_error, error.parsed_response['error'], error.parsed_response['details']
        else
          log :standard_error, error
        end

        log :redirect_tip if response && [301,302].include?(response.status)
      end

      def prepare_body_to_send
        fix_font_file_encoding
        return @hash_body if @options[:multipart]

        body_should_be_json? ? @hash_body.to_json : @hash_body
      end

      def body_should_be_json?
        [:post, :put, :patch].include?(@request_type)
      end

      def connection
        @options[:multipart] ? multipart_connection : json_connection
      end

      def json_connection
        @json_connection ||= Faraday.new(basic_configuration.deeper_merge(headers: { 'Content-Type' => 'application/json' }))
      end

      def multipart_connection
        @multipart_connection ||= Faraday.new(basic_configuration) do |connection|
          connection.request :multipart
          connection.request :url_encoded
          connection.adapter :net_http
        end
      end

      def basic_configuration
        {
          url: MarketplaceKit.config.url,
          headers: {
            'UserTemporaryToken' => MarketplaceKit.config.token,
            'Accept' => 'application/vnd.nearme.v4+json'
          }
        }.tap do |config|
          config[:ssl] = { verify: false } unless MarketplaceKit.config.endpoint == 'production'
        end
      end

      def fix_font_file_encoding
        return unless font_file?

        @hash_body[:marketplace_builder_file_body] = file_body.force_encoding('ISO-8859-1').encode('UTF-8')
      end

      FONT_TYPES = %w(.eot .otf .ttc .ttf .woff .woff2 .svg)

      def font_file?
        path && path.start_with?('custom_themes') && FONT_TYPES.include?(File.extname(path)) && file_body
      end

      def file_body
        @hash_body[:marketplace_builder_file_body]
      end

      def path
        @hash_body[:path]
      end
    end
  end
end
