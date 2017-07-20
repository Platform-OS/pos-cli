module MarketplaceKit
  module Services
    class ApiErrorHandler
      def initialize(error, response)
        @error = error
        @response = response
      end

      def process
        puts '```'.red

        if @error.is_a?(JSON::ParserError)
          process_json_error
        elsif @error.is_a?(Errors::ApiError)
          process_api_error
        else
          process_standard_error
        end

        puts '```'.red
      end

      private

      def process_json_error
        puts 'Error while parsing JSON'.red
        puts "Raw body:\n#{@response.body}"
      end

      def process_api_error
        puts "Builder error: #{@error.parsed_response['error']}".red
        puts 'Details:'
        puts @error.parsed_response['details']
      end

      def process_standard_error
        puts "Error: #{@error.message} (#{@error.class})".red
      end
    end
  end
end
